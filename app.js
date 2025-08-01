const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 80;

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-1';

if (!BUCKET) {
  console.error('Missing S3_BUCKET env var');
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (_req, res) => {
  const pets = await loadPets();
  const withUrls = await Promise.all(pets.map(async p => {
    try {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: p.imageKey }),
        { expiresIn: 3600 }
      );
      return { ...p, imageUrl: url };
    } catch (e) {
      console.error('Presign failed for', p.imageKey, e.message);
      return { ...p, imageUrl: '#' };
    }
  }));
  res.send(renderIndex(withUrls));
});

app.post('/pets', upload.single('photo'), async (req, res) => {
  try {
    const { name, breed, age } = req.body;
    if (!name || !breed || !age || !req.file) return res.status(400).send('Missing fields');

    const sanitizedName = req.file.originalname.replace(/\s+/g, '_').replace(/[^\w\.\-]/g, '');
    const key = `images/${uuid()}_${sanitizedName}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    const pets = await loadPets();
    pets.push({ id: uuid(), name, breed, age, imageKey: key, createdAt: new Date().toISOString() });
    await savePets(pets);

    res.redirect('/');
  } catch (e) {
    console.error(e);
    res.status(500).send('Upload failed');
  }
});

const PETS_KEY = 'data/pets.json';

async function loadPets() {
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: PETS_KEY }));
    const text = await streamToString(Body);
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function savePets(pets) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: PETS_KEY,
    Body: JSON.stringify(pets, null, 2),
    ContentType: 'application/json'
  }));
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', d => chunks.push(d));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function renderIndex(pets) {
  const items = pets.map(p => `
    <li class="pet">
      <img src="${p.imageUrl}" alt="${p.name}" />
      <div><strong>${p.name}</strong></div>
      <div>Breed: ${p.breed}</div>
      <div>Age: ${p.age}</div>
    </li>
  `).join('');
  return `
  <!doctype html><html><head>
    <meta charset="utf-8"><title>Pet Listing</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="/style.css">
  </head><body>
    <h1>Pet Listing</h1>
    <section class="form">
      <h2>Add a Pet</h2>
      <form action="/pets" method="post" enctype="multipart/form-data">
        <input name="name" placeholder="Name" required />
        <input name="breed" placeholder="Breed" required />
        <input name="age" placeholder="Age" required />
        <input type="file" name="photo" accept="image/*" required />
        <button type="submit">Upload</button>
      </form>
    </section>
    <section>
      <h2>Adoptable Pets</h2>
      <ul class="grid">${items || '<p>No pets yet. Add one above.</p>'}</ul>
    </section>
  </body></html>`;
}

app.listen(PORT, () => console.log(`Pet Listing running on ${PORT}`));
