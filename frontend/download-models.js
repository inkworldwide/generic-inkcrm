import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const files = [
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.weights',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.weights',
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.weights'
];

async function downloadFile(filename) {
  const dest = path.join(modelsDir, filename);
  const file = fs.createWriteStream(dest);
  
  console.log(`Downloading ${filename}...`);
  return new Promise((resolve, reject) => {
    https.get(baseUrl + filename, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  for (const f of files) {
    try {
      await downloadFile(f);
    } catch (e) {
      console.error('Error downloading ' + f, e);
    }
  }
  console.log('All models downloaded!');
}

main();
