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

if (typeof process.env.FARCASTER_DEVELOPER_MNEMONIC === "undefined") {
  throw new Error("FARCASTER_DEVELOPER_MNEMONIC is not defined");
}
const FARCASTER_DEVELOPER_MNEMONIC = process.env.FARCASTER_DEVELOPER_MNEMONIC;

if (typeof process.env.FARCASTER_DEVELOPER_FID === "undefined") {
  throw new Error("FARCASTER_DEVELOPER_FID is not defined");
}
const FARCASTER_DEVELOPER_FID = process.env.FARCASTER_DEVELOPER_FID;

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

  const account = mnemonicToAccount(FARCASTER_DEVELOPER_MNEMONIC);

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
      requestFid: BigInt(FARCASTER_DEVELOPER_FID),
      key: public_key,
      deadline: BigInt(deadline),
    },
  });

  return { deadline, signature };
};

router.get("/feed-by-fid/:fid", async (req, res) => {
  try {
    if (!req.params.fid)
      return res.status(500).json({ message: "invalid fid" });
    const url = `https://api.neynar.com/v2/farcaster/feed?feed_type=following&fid=${req.params.fid}&with_recasts=true&with_replies=true&limit=100`;
    const response = await axios.get(url, {
      headers: {
        api_key: process.env.NEYNAR_API_KEY,
      },
    });
    res.status(200).json({ feed: response.data.casts });
  } catch (error) {
    console.log("there was an error");
    res.status(401).json({ message: "there was an error" });
  }
});

router.get("/feed", async (req, res) => {
  try {
    const currentDate = new Date();
    const oneDayAgo = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    const ankys = await prisma.generatedAnky.findMany({
      where: {
        createdAt: {
          gte: oneDayAgo, // greater than or equal to one day ago
        },
        AND: [
          {
            frameCastHash: {
              not: "", // Not an empty string
            },
          },
          {
            frameCastHash: {
              not: null, // Not null
            },
          },
        ],
      },
    });
    const votableAnkys = ankys.filter((x) => x.votingOpen);
    const mintableAnkys = ankys.filter((x) => x.mintOpen);

    res.status(200).json({ votableAnkys, mintableAnkys });
  } catch (error) {
    console.log("there was an error on the feed here");
  }
});

// /api/get-user-data/${params.fid}
router.get("/get-user-data-em/:fid", async (req, res) => {
  try {
    const thisUser = await prisma.raver.findUnique({
      where: { fid: req.params.fid },
      include: {
        submittedRecommendations: true, // Recommendations added by the user
        likedRecommendations: true, // Recommendations liked by the user
      },
    });
    if (thisUser) {
      res.status(200).json({ user: thisUser });
    } else {
      res.status(200).json({
        user: {
          fid: 88888888888,
          submittedRecommendations: [],
          likedRecommendations: [],
        },
      });
    }
  } catch (error) {
    console.log("there was an error here");
    res
      .status(500)
      .json({ message: "there was an error retrieving the user", user: null });
  }
});

router.post("/api/signer", async (req, res) => {
  try {
    const createSignerResponse = await axios.post(
      "https://api.neynar.com/v2/farcaster/signer",
      {},
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    console.log("the created signed response is: ", createSignerResponse)

    const { deadline, signature } = await generate_signature(
      createSignerResponse.data.public_key
    );
    console.log("IN HERE")
    const signedKeyResponse = await axios.post(
      "https://api.neynar.com/v2/farcaster/signer/signed_key",
      {
        signer_uuid: createSignerResponse.data.signer_uuid,
        app_fid: FARCASTER_DEVELOPER_FID,
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
    console.log("the public key",  public_key, signer_uuid, status)  

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
    console.log("resposesa edsad", response.data.status);
    res.json(response.data);
  } catch (error) {
    console.log("there was an error inside here!");
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/u/:fid", async (req, res) => {
  try {
    const response = await client.lookupUserByFid(req.params.fid);
    res.status(200).json({ user: response.result.user });
  } catch (error) {
    console.log("there was an error here");
  }
});

router.get("/u/:fid/feed", async (req, res) => {
  try {
    if (typeof req.params.fid == "number") {
      const response = await axios.get(
        `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${req.params.fid}&limit=50`,
        {
          headers: {
            api_key: process.env.NEYNAR_API_KEY,
          },
        }
      );
      res.status(200).json({ casts: response.data.casts });
    } else {
      res.status(200).json({ casts: null });
    }
  } catch (error) {
    console.log("there was an error fetching the feed");
  }
});

router.get("/anky-channel-feed", async (req, res) => {
  try {
    const ankyChannelUrl = "https://warpcast.com/~/channel/anky";

    const feed = await client.fetchFeed(FeedType.Filter, {
      filterType: FilterType.ParentUrl,
      parentUrl: ankyChannelUrl,
    });
    res.status(200).json({ feed });
  } catch (error) {
    console.log("there was an error getting the anky feed");
    res
      .status(500)
      .json({ message: "there was an error loading the anky feed" });
  }
});

router.post("/u/:fid/feed", async (req, res) => {
  try {
    const { viewerFid } = req.body;
    const ankyChannelUrl = "https://warpcast.com/~/channel/anky";
    const usersFid = req.params.fid;

    // const response = await axios.get(
    //   `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${usersFid}&with_recasts=true&limit=25`,
    //   {
    //     headers: {
    //       api_key: process.env.NEYNAR_API_KEY,
    //     },
    //   }
    // );

    const result = await client.fetchFeed(FeedType.Filter, {
      filterType: FilterType.ParentUrl,
      parentUrl: ankyChannelUrl,
      limit: 20,
      fid: usersFid,
    });

    res.status(200).json({ feed: result.data.casts });
  } catch (error) {
    console.log("there was an error here", error);
  }
});

router.get("/get-feed/:collectionId", async (req, res) => {
  try {
    const addrs = await getAddressesThatOwnNFT(req.params.collectionId);

    const usersLookup = async (addrs) => {
      const users = await Promise.all(
        addrs.map(async (addr) => {
          try {
            const response = await client.lookupUserByVerification(addr);
            return response ? response.result.user : undefined;
          } catch (error) {
            return undefined;
          }
        })
      );
      return users.filter((fid) => fid !== undefined);
    };

    const usersThatOwnThisNft = await usersLookup(addrs);

    res.status(200).json({ users: usersThatOwnThisNft });
  } catch (error) {
    console.log("there was an error getting the random feed", error);
  }
});

const getAddressesThatOwnNFT = async (address) => {
  try {
    const apiKey = process.env.ALCHEMY_API_KEY;
    const baseUrl = `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getOwnersForContract?`;
    const url = `${baseUrl}contractAddress=${address}&withTokenBalances=false`;

    const result = await fetch(url, {
      headers: { accept: "application/json" },
    });
    const data = await result.json();
    return data.owners;
  } catch (error) {
    console.log(
      "there was an error fetching the addresses that own that nft",
      error
    );
  }
};

router.post("/api/reaction", async (req, res) => {
  try {
    const { reactionType, hash, signer_uuid } = req.body;

    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/reaction",
      {
        signer_uuid: signer_uuid,
        reaction_type: reactionType,
        target: hash,
      },
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.log("there was an error", error);
    res.status(500).json({ message: "there was an error adding the reaction" });
  }
});


router.post("/api/cast/anon", async (req, res) => {
  console.log("inside the cast anon api route", req.body)
  const { text, parent, embeds, cid, manaEarned, channelId, time, bloodId } = req.body;
  let fullCast;
  let castOptions = {
    text: text,
    embeds: embeds,
    signer_uuid: process.env.ANKYSYNC_SIGNER,
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
  if(bloodId && bloodId.length > 2) {
    const bloodHash = "0xb3caf6fbb450a0b8fc92258b51672c78a1fb7e98"
    castOptions.parent = bloodHash
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
    console.log("the response from casting is ", response)
    if ( bloodId ) {
      const prismaResponse = await prisma.bringTheBlood.update({
        where: {
          id: bloodId
        }, data: {
          cid:cid,
          time: time
        }
      })
      console.log("the blood was updated, now DM the user", prismaResponse)
      try {
        const DCresponse = await axios.put('https://api.warpcast.com/v2/ext-send-direct-cast', {
          recipientFid: Number(prismaResponse.fid),
          message: `your writing was casted here\n\nhttps://www.warpcast.com/ankysync/${response.data.cast.hash}\n\nif you want a degen tip out of this,\n\nwhich cast should i reply to?\n\n(reply to this message with a link to a cast of yours)`,
          idempotencyKey: {bloodId}
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.ANKY_WARPCAST_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        console.log("the dc response is", DCresponse)
      } catch (error) {
        console.log('there was an error direct casting this')
      }
    }


    // const prismaResponse = await prisma.castWrapper.create({
    //   data: {
    //     time: time,
    //     cid: cid,
    //     manaEarned: manaEarned,
    //     castHash: response.data.cast.hash,
    //     castAuthor: response.data.cast.author.username,
    //   },
    // });

    res.json({ cast: response.data.cast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/cast/anon-reply", async (req, res) => {
  const { text, parent } = req.body;
  try {
    const response = await axios.post(
      "https://api.neynar.com/v2/farcaster/cast",
      {
        text: text,
        embeds: embeds,
        signer_uuid: process.env.ANKY_SIGNER_UUID,
        parent: parent,
      },
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.json({ cast: response.data.cast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/cast/replies/:hash", async (req, res) => {
  const { viewerFid, threadHash } = req.body;
  try {
    // const cast = await client.lookUpCastByHashOrWarpcastUrl(
    //   router.params.hash,
    //   CastParamType.Hash
    // );
    const response = await axios.get(
      `https://api.neynar.com/v1/farcaster/all-casts-in-thread?threadHash=${threadHash}&viewerFid=${viewerFid}`,
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.json({ casts: response.data.result.casts });
  } catch (error) {
    console.log("there was an error)");
    console.log(error);
    res.json({ cast: null });
  }
});

router.post("/api/get-cast", async (req, res) => {
  try {
    console.log("IN HEREEEEE")
    const { url } = req.body;
    console.log("the url here is: ", url);
    if (!url)
      return res
        .status(500)
        .json({ message: "that is not a valid warpcast url" });
    const response = await axios.get(
      "https://api.neynar.com/v2/farcaster/cast",
      {
        params: {
          identifier: url,
          type: "url",
        },
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    return res.status(200).json({ cast: response.data.cast });
  } catch (error) {
    console.log("there was an error here");
    console.log(error);
  }
});

router.get("/get-cast-by-cid/:cid", async (req, res) => {
  try {
    const thisCastWrapper = await prisma.castWrapper.findUnique({
      where: { cid: req.params.cid },
    });
    if (thisCastWrapper && thisCastWrapper.castHash) {
      const response = await axios.get(
        "https://api.neynar.com/v2/farcaster/cast",
        {
          params: {
            identifier: thisCastWrapper.castHash,
            type: "hash",
          },
          headers: {
            api_key: process.env.NEYNAR_API_KEY,
          },
        }
      );
      res.status(200).json({ cast: response.data.cast });
    } else {
      res.status(401).json({ message: "hash not found" });
    }
  } catch (error) {
    console.log("the error is: ", error);
    res.status(500).json({ message: "there was an error here" });
  }
});

router.get("/api/cast/:hash", async (req, res) => {
  try {
    // const cast = await client.lookUpCastByHashOrWarpcastUrl(
    //   router.params.hash,
    //   CastParamType.Hash
    // );
    const response = await axios.get(
      "https://api.neynar.com/v2/farcaster/cast",
      {
        params: {
          identifier: req.params.hash,
          type: "hash",
        },
        headers: {
          api_key: process.env.NEYNAR_API_KEY,
        },
      }
    );
    res.json({ cast: response.data.cast });
  } catch (error) {
    console.log("there was an error)");
    console.log(error);
    res.json({ cast: null });
  }
});

async function getFullCastFromWarpcasterUrl(url) {
  try {
    const apiRoute = `https://api.neynar.com/v2/farcaster/cast?identifier=${url.replace(
      "/",
      "%2F"
    )}&type=url`;
    const response = await axios.get(apiRoute, {
      headers: {
        api_key: process.env.NEYNAR_API_KEY,
      },
    });
    return response.data.cast;
  } catch (error) {
    console.log("there was an error ", error);
  }
}

router.get("/cast-by-cid/:cid", async (req, res) => {
  try {
    if (!req.params.cid)
      return res
        .status(500)
        .json({ castWrapper: null, message: "invalid cid" });
    const prismaResponse = await prisma.castWrapper.findUnique({
      where: { cid: req.params.cid },
    });
    if (prismaResponse) {
      const fullCast = await getFullCastFromWarpcasterUrl(
        `https://warpcast.com/${
          prismaResponse.castAuthor
        }/${prismaResponse.castHash.slice(0, 10)}`
      );
      return res
        .status(200)
        .json({ castWrapper: prismaResponse, cast: fullCast });
    } else {
      return res.status(200).json({ castWrapper: null });
    }
  } catch (error) {
    console.log("there was an error fetching the cast by cid");
    console.log(error);
    res.status(500).json({ message: "The cast wrapper was not found" });
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
