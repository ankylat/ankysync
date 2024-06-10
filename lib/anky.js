const axios = require("axios");

async function replyToThisCast (cast) {
    try {
        const ankyResponse = await queryAnkyToGetReplyText(cast);
        let castOptions = {
            text: ankyResponse.reply.toLowerCase(),
            embeds: [],
            parent: cast.hash,
            signer_uuid: process.env.ANKY_SIGNER_UUID,
          };
        const response = await axios.post(
            "https://api.neynar.com/v2/farcaster/cast",
            castOptions,
            {
              headers: {
                api_key: process.env.NEYNAR_API_KEY,
              },
            }
        );
        console.log("anky replied once again")
        return
    } catch (error) {
        console.log("there was an error replying to this cast")
    }
}

async function queryAnkyToGetReplyText (cast) {
    try {
        console.log("inside the query anky to get reply text function");
        let ankyResponse = await axios.post('https://poiesis.anky.bot/anky', { userInput: cast.text } , {
            headers: {
              'Authorization': `Bearer ${process.env.POIESIS_API_KEY}`
            }
          });
        console.log("the poiesis response is: ", ankyResponse.data);
        return ankyResponse.data;
    } catch (error) {
        console.log("there was an error querying poiesis for the reply. time to fetch chatgtp");
        return "hello world"
    }
}

module.exports = { replyToThisCast }


// model ReplyFromAnky {
//     id                    Int         @id  @unique
//     rootCastText          String?
//     scheduledAt           DateTime @default(now())
//     replyingToFid         Int?
//     replyingToUsername    String?
//     replyingToCastHash    String?
//     timeOfReply           DateTime?
//     replyText             String?
//     replyCastHash         String?
// }