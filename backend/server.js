const express = require('express')
const cors = require('cors')
const speech = require("@google-cloud/speech")
const dotenv = require('dotenv')
const app = express();
const multer = require('multer');
const path  = require('path')
const fs = require("fs")
const ffmpegPath = require("ffmpeg-static")
const ffmpeg = require("fluent-ffmpeg")
app.use(cors())
dotenv.config()
const PORT = process.env.PORT || 3000;


const client = new speech.SpeechClient({
    keyFilename:process.env.GOOGLE_APPLICATION_CREDENTIALS
})


//multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})
const upload = multer({
    storage: storage
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
ffmpeg.setFfmpegPath(ffmpegPath)



app.get("/", (req, res) => {
    res.send("Welcome to AI Transcription API")
})



app.post("/transcribe", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("no file uploaded")
    }

    const videoFilePath = req.file.path
    const audioFilePath = `${videoFilePath}.wav`;

    ffmpeg(videoFilePath)
        .toFormat("wav")
        .audioCodec("pcm_s16le")
        .audioFrequency(16000)
        .audioChannels(1)
        .on("end", async () => {
            const audioBytes = fs.readFileSync(audioFilePath).toString("base64")
            const request = {
                audio: {
                    content: audioBytes
                },
                config: {
                    encoding: "LINEAR16",
                    sampleRateHeartz: 160000,
                    languageCode: "en-US"
                }
            }
            try {
                const [response] = await client.recognize(request)
                const transcription = response.results.map(result => {
                    return result.alternatives[0].transcript
                }).join("\n");
        
                fs.unlinkSync(videoFilePath);
                fs.unlinkSync(audioFilePath);
                res.send({
                    text:transcription
                });
        
            } catch (error) {
                console.error(`API error:${error}`)
                res.status(500).send(`Error tanscribing Video: ${error.message}`)
            }
        })
        .on("error", (error) => {
            console.error("Error Extracting audio", error)
            res.status.send("error processing video")
        })
        .save(audioFilePath)
})



app.listen(PORT, () => {
    console.log('Server is running on port', PORT);
})