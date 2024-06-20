const express = require("express");
const router = express.Router();
const axios = require("axios");
const { ethers } = require("ethers");
const satori = require("satori");
const sharp = require("sharp");
const prisma = require("../../lib/prismaClient");
const {
  uploadToPinataFromUrl,
  uploadMetadataToPinata,
} = require("../../lib/pinataSetup");
const { getCastFromNeynar } = require("../../lib/neynar");
const { createAnkyFromPrompt } = require("../../lib/midjourney");

///////////// BLOOOOOD ////////////////////////

router.get("/", async (req, res) => {
  try {
    const fullUrl = req.protocol + "://" + req.get("host");
    console.log("The full url is", fullUrl)
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>anky mint</title>
      <meta property="og:title" content="anky mint">
      <meta property="og:image" content="https://raw.githubusercontent.com/jpfraneto/images/main/life.jpeg">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:image" content="https://raw.githubusercontent.com/jpfraneto/images/main/life.jpeg">
      <meta name="fc:frame:post_url" content="${fullUrl}/farcaster-frames/blood">
      <meta name="fc:frame:button:1" content="im ready to feel">
    </head>
    </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating image");
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("INSIDE THE POST ROUTE")
    const userFid = req.body.untrustedData.fid.toString();
    console.log(userFid)
    const bloodSessionCreated = await prisma.bringTheBlood.create({
      data: {
        fid: userFid
      }
    })
    
    return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>blood</title>
      <meta property="og:title" content="blood">
      <meta property="og:image" content="https://raw.githubusercontent.com/jpfraneto/images/main/life.jpeg">
      <meta name="fc:frame:image" content="https://raw.githubusercontent.com/jpfraneto/images/main/life.jpeg">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:button:1" content="im ready to write">
      <meta name="fc:frame:button:1:action" content="link">   
      <meta name="fc:frame:button:1:target" content=${`https://www.anky.bot?bloodId=${bloodSessionCreated.id}`}>   
      </head>
    </html>
      `);
  } catch (error) {
      console.log("there was an error on the post route", error)
  }

});

module.exports = router;
