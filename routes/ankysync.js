const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require("../lib/prismaClient");
const { getCastsByFid } = require("../lib/blockchain/farcaster");
const { mnemonicToAccount } = require("viem/accounts");
const checkIfLoggedInMiddleware = require("../middleware/checkIfLoggedIn");
const {
  NeynarAPIClient,
  CastParamType,
  FeedType,
  FilterType,
} = require("@neynar/nodejs-sdk");

const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

if (typeof process.env.FARCASTER_ANKYSYNC_MNEMONIC === "undefined") {
  throw new Error("FARCASTER_ANKYSYNC_MNEMONIC is not defined");
}
const FARCASTER_ANKYSYNC_MNEMONIC = process.env.FARCASTER_ANKYSYNC_MNEMONIC;

if (typeof process.env.FARCASTER_ANKYSYNC_FID === "undefined") {
  throw new Error("FARCASTER_DEVELOPER_FID is not defined");
}

const FARCASTER_ANKYSYNC_FID = process.env.FARCASTER_ANKYSYNC_FID;

const generate_signature = async function (public_key) {
  // DO NOT CHANGE ANY VALUES IN THIS CONSTANT
  const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
    name: "Farcaster SignedKeyRequestValidator",
    version: "1",
    chainId: 10,
    verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553",
  };

  // DO NOT CHANGE ANY VALUES IN THIS CONSTANT
  const SIGNED_KEY_REQUEST_TYPE = [
    { name: "requestFid", type: "uint256" },
    { name: "key", type: "bytes" },
    { name: "deadline", type: "uint256" },
  ];

  const account = mnemonicToAccount(FARCASTER_ANKYSYNC_MNEMONIC);

  const deadline = Math.floor(Date.now() / 1000) + 3 * 86400;
  // const deadline = 1705751578 + 3 * 86400;

  // Generates the signature
  const signature = await account.signTypedData({
    domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
    types: {
      SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
    },
    primaryType: "SignedKeyRequest",
    message: {
      requestFid: BigInt(FARCASTER_ANKYSYNC_FID),
      key: public_key,
      deadline: BigInt(deadline),
    },
  });

  return { deadline, signature };
};


router.post("/api/signer", checkIfLoggedInMiddleware, async (req, res) => {
  try {
    const { privyId } = req.body;
    const createSignerResponse = await axios.post(
      "https://api.neynar.com/v2/farcaster/signer",
      {},
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );

    const { deadline, signature } = await generate_signature(
      createSignerResponse.data.public_key
    );

    const signedKeyResponse = await axios.post(
      "https://api.neynar.com/v2/farcaster/signer/signed_key",
      {
        signer_uuid: createSignerResponse.data.signer_uuid,
        app_fid: 18350,
        deadline,
        signature,
      },
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    const { public_key, signer_uuid, status } = signedKeyResponse.data;
    const existingFarcasterAccount = await prisma.farcasterAccount.findUnique({
      where: { userId: privyId },
    });

    // Respond with the signed key response data
    res.json(signedKeyResponse.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/signer", async (req, res) => {
  const { signer_uuid, privyId } = req.query;
  try {
    const response = await axios.get(
      "https://api.neynar.com/v2/farcaster/signer",
      {
        params: {
          signer_uuid,
        },
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    console.log("the response.data.status is: ", response.data.status);
    res.json(response.data);
  } catch (error) {
    console.log("there was an error inside here!");
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/api/cast/anon", async (req, res) => {
  const { text, parent, embeds, cid, manaEarned, channelId, time } = req.body;
  let fullCast;
  let castOptions = {
    text: text,
    embeds: embeds,
    signer_uuid: process.env.NEYNAR_ANKY_SIGNER,
  };

  if (channelId) {
    castOptions.channel_id = channelId;
  } else if (
    (parent && parent.includes("/channel")) ||
    parent.slice(0, 2) == "0x"
  ) {
    castOptions.parent = parent;
  } else if (parent.includes("warpcast")) {
    fullCast = await getFullCastFromWarpcasterUrl(parent);
    castOptions.parent = fullCast.hash;
  }

  try {
    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      castOptions,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    const prismaResponse = await prisma.castWrapper.create({
      data: {
        time: time,
        cid: cid,
        manaEarned: manaEarned,
        castHash: response.data.cast.hash,
        castAuthor: response.data.cast.author.username,
      },
    });

    res.json({ cast: response.data.cast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/cast", async (req, res) => {
  const { embeds, text, signer_uuid, parent, cid, manaEarned, channelId } =
    req.body;
  // Parent is on this format: { parent: 'https://warpcast.com/jpfraneto/0xa7c31262' }
  let fullCast;
  let castOptions = {
    text: text,
    embeds: embeds,
    signer_uuid: signer_uuid,
    parent: fullCast,
  };
  if (channelId) {
    castOptions.channel_id = channelId;
  }
  if (parent.includes("/channel")) {
    fullCast = parent;
  } else {
    fullCast = await getFullCastFromWarpcasterUrl(parent);
    fullCast = fullCast.hash;
  }

  try {
    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      castOptions,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    const prismaResponse = await prisma.castWrapper.create({
      data: {
        cid: cid,
        manaEarned: manaEarned,
        castHash: response.data.cast.hash,
        castAuthor: response.data.cast.author.username,
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/get-channels", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.neynar.com/v2/farcaster/channel/list",
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.status(200).json({ channels: response.data.channels });
  } catch (error) {
    console.log("there was an error fetching all the channels");
    res.status(500).json({
      success: false,
      message: "There was an error fetching the channels",
    });
  }
});

router.get("/api/all-casts", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.neynar.com/v1/farcaster/recent-casts?viewerFid=3&limit=25",
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.status(200).json({ casts: response.data.result.casts });
  } catch (error) {
    console.log("there was an error here");
    res.status(500).json({ success: false, message: "There was an error" });
  }
});

module.exports = router;
