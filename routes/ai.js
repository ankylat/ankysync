const express = require("express");
const { generateAnkyFromUserWriting } = require("../lib/ai/anky-factory");
const { fetchImageProgress } = require("../lib/ai/midjourney");
const prisma = require("../lib/prismaClient");

const OpenAI = require("openai");
const axios = require("axios");
const { reflectUserWriting } = require("../lib/ai/chatgtp"); // Import the functions
const { updateWinningImageForThisAnky } = require("../lib/ankys");
const checkIfLoggedInMiddleware = require("../middleware/checkIfLoggedIn");
const {
  uploadMetadataToPinata,
  uploadImageToPinata,
} = require("../lib/pinataSetup");
const router = express.Router();

const openai = new OpenAI();

router.post("/process-writing", checkIfLoggedInMiddleware, async (req, res) => {
  if (!openai) {
    res.status(500).json({
      error: {
        message:
          "OpenAI API key not configured, please follow instructions in README.md",
      },
    });
    return;
  }

  const message = req.body.text || "";
  const parentCastHash = req.body.parentCastHash;
  const cid = req.body.cid;
  if (message.trim().length === 0) {
    res.status(400).json({
      error: {
        message: "Please enter a valid message",
      },
    });
    return;
  }
  try {
    const messages = [
      {
        role: "system",
        content: `You are in charge of imagining a description of a human being in a cartoon world. I will send you a block of text that was written as a stream of consciousness, and your goal is to distill the essence of that writing so that you can come up with a description of a piece of art that deeply reflect the state of that human, also crafting a short story that reflects what the user wrote. Also a reflection of the user.
        
        On the image prompt, please avoid direct references to the writer, or the technologies that take place. The goal of the piece of art is just to reflect the subconscious of the writer.

        On the story, make it fun and appealing. Make the user smile, but don't over act it. Remember to make the story less than 300 characters.

        On the reflection, make it sharp and straight to the point. Your mission is to trigger the user to go deeper

        Give everything a title, of less than 5 words. 4 words at the most.

        Practically speaking, create a valid JSON object following this exact format:

        {
            "imagePrompt": "A one paragraph description of the image that reflects the situation of the users writing. less than 500 characters",
            "story": "A short story and metaphor that reflects what the user wrote. less than 300 chars.",
            "reflection": "A reflection of the subconscious of the user that acts as a trigger. You will show the user what the user can't see because it is unconscious",
            "title": "The title of this piece of art",
        }
    
        The JSON object, correctly formatted is: `,
      },
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: messages,
    });

    const dataResponse = completion.choices[0].message.content;

    const storyRegex = /"story"\s*:\s*"([\s\S]*?)"/;
    const promptsRegex = /"imagePrompt"\s*:\s*"([\s\S]*?)"/;
    const titleRegex = /"title"\s*:\s*"([\s\S]*?)"/;
    const reflectionRegex = /"reflection"\s*:\s*"([\s\S]*?)"/;

    const storyMatch = dataResponse.match(storyRegex);
    const promptMatch = dataResponse.match(promptsRegex);
    const titleMatch = dataResponse.match(titleRegex);
    const reflectionMatch = dataResponse.match(reflectionRegex);

    let story, prompt, title, reflection;

    if (promptMatch !== null && promptMatch.length > 1) {
      prompt = promptMatch[1];
    }

    if (storyMatch !== null && storyMatch.length > 1) {
      story = storyMatch[1];
    }

    if (titleMatch !== null && titleMatch.length > 1) {
      title = titleMatch[1];
    }

    if (reflectionMatch !== null && reflectionMatch.length > 1) {
      reflection = reflectionMatch[1];
    }
    // return res.status(200).json({ story, prompt });

    const config = {
      headers: { Authorization: `Bearer ${process.env.IMAGINE_API_TOKEN}` },
    };

    let imagineApiID, newImagePrompt;
    if (prompt && story) {
      newImagePrompt = `https://s.mj.run/YLJMlMJbo70, ${prompt}`;
      const responseFromImagineApi = await axios.post(
        `http://${process.env.MIDJOURNEY_SERVER_IP}:8055/items/images`,
        {
          prompt: newImagePrompt,
        },
        config
      );
      imagineApiID = responseFromImagineApi.data.data.id;
      await prisma.generatedAnky.create({
        data: {
          ankyBio: story,
          imagineApiID: imagineApiID,
          imagePrompt: newImagePrompt,
          imagineApiStatus: "pending",
          reflection: reflection,
          cid: cid,
          imageIPFSHash: null,
          metadataIPFSHash: null,
          parentCastHash: parentCastHash,
          title: title,
          votingOpen: true,
          mintOpen: false,
        },
      });
      console.log("the anky was sent for geneartion");

      return res.status(200).json({
        success: true,
        imagineApiID: imagineApiID,
        userBio: story,
        reflection: reflection,
      });
    } else {
      return res.status(500).json({
        message: "There was an error processing the users writing.",
      });
    }
  } catch (error) {
    console.log("there was an errrorrrqascascas", error);
    return res.status(500).json({ message: "There was an error" });
  }
});

router.get("/", (req, res) => {
  console.log("in the ai get route");
});

router.post(
  "/get-feedback-from-writing",
  checkIfLoggedInMiddleware,
  async (req, res) => {
    const response = await reflectUserWriting(
      req.body.text,
      req.body.user,
      req.body.prompt,
      res
    );
    res.json({ ankyResponse: response });
  }
);

router.post(
  "/create-anky-from-writing",
  checkIfLoggedInMiddleware,
  async (req, res) => {
    const response = await generateAnkyFromUserWriting(req.body.text);
    console.log("The response is: ", response);
    res.json({ anky: response });
  }
);

router.get("/check-image/:imageId", async (req, res) => {
  const imageId = req.params.imageId;
  const imageProgress = await fetchImageProgress(imageId);
  if (imageProgress) {
    return res.json(imageProgress);
  } else {
    return res.status(404).send("Image not found");
  }
});

router.get(`/mint-an-anky/:cid`, async (req, res) => {
  try {
    const thisAnky = await prisma.generatedAnky.findUnique({
      where: { cid: req.params.cid },
    });
    const votes = await prisma.vote.findMany({
      where: {
        ankyCid: req.params.cid,
      },
    });
    res.status(200).json({ anky: thisAnky, votes: votes });
  } catch (error) {
    console.log("the werror is: ", error);
    res.status(500).json({ message: "there was an error getting your anky" });
  }
});

module.exports = router;
