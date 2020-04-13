const Ocrad = require('ocrad.js');
const Canvas = require('canvas');
const Image = Canvas.Image;
const glob = require('glob');
const path = require('path');
const Tesseract = require('tesseract.js');
const { createWorker, createScheduler } = require('tesseract.js');

const captchaGlob = __dirname + '/model/*.jpg';

/**
 * @returns {string[]}
 */
function loadCaptchas() {
  return new Promise((resolve, reject) => {
    glob(captchaGlob, (err, captchas) => {
      if (err) reject(err);
      resolve(captchas);
    });
  });
}

function imageFromPath(src) {
  const image = new Image();
  image.src = src;
  return image;
}

/**
 * Creates a canvas from a HTML image element
 * @param image The image to use
 * @param scale Optional scale to apply to the image
 */
function imageToCanvas(image, scale = 1) {
  const width = image.width * scale;
  const height = image.height * scale;
  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

function prettyPercent(num) {
  return `${Math.round(num * 100)}%`;
}

async function OcradAsync(canvas) {
  return new Promise((resolve, reject) => {
    try {
      const result = Ocrad(canvas);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

const scheduler = createScheduler();

async function initTesseractWorker() {
  const worker = createWorker({
    langPath: path.join(__dirname, './', 'lang-data'),
    // logger: m => console.log(m),
  });

  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  scheduler.addWorker(worker);
}

async function initRecognizer() {
  for (let i = 0; i < 6; i++) {
    await initTesseractWorker();
  }
}

async function recognizeImageFromPath(src, method = 'tesseract') {
  if (method === 'ocrad') {
    const image = imageFromPath(src);
    const canvas = imageToCanvas(image, 1);
    return (await OcradAsync(canvas)).trim();
  } else if (method === 'tesseract') {

    // const { data: { text } } = await worker.recognize(src);
    // await worker.terminate();
    const { data: { text } } = await scheduler.addJob('recognize', src);
    return text.trim();

    /* Tesseract.recognize(
      src,
      'eng',
      { logger: m => console.log(m) }
    ).then(({ data }) => {
      console.log(data);
      resolve(data.text);
    }).catch(reject); */
  }
}

async function main() {
  console.time('recognize');
  const captchas = await loadCaptchas();
  let averageAccuracy = 0;
  let totalCorrect = 0;
  await initRecognizer();
  await Promise.all(captchas.slice(0, 1).map(async (src) => {
    const actualCaptchaText = path.basename(src, path.extname(src));
    const captchaText = await recognizeImageFromPath(src);
    let accuracy = 0;
    for (let i = 0; i < actualCaptchaText.length; i++) {
      const char = captchaText[i];
      const actualChar = actualCaptchaText[i];
      if (char === actualChar) {
        accuracy++;
      }
    }
    accuracy /= actualCaptchaText.length;
    averageAccuracy += accuracy;
    if (captchaText === actualCaptchaText) {
      totalCorrect++;
    }
    console.log(captchaText, actualCaptchaText, prettyPercent(accuracy));
  }));
  await scheduler.terminate();
  console.log(`${prettyPercent(totalCorrect / captchas.length)} correct, ${prettyPercent(averageAccuracy / captchas.length)} accuracy`);
  console.timeEnd('recognize');
}
main().catch(console.log);