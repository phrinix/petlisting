# PetPost (EC2 + S3, no DB)

A tiny Node.js/Express app that lets volunteers upload adoptable pets (name, breed, age, photo). Photos are stored in **Amazon S3** and metadata is saved as a simple `pets.json` file in S3. No database and no auth (per assignment constraints).

## Architecture

```
[ User Browser ]
       |
       v
[ EC2: Node/Express ]  --reads/writes-->  [ S3 Bucket ]
     (HTTP 80)                             - images/
                                           - data/pets.json
```

## Prerequisites

- AWS account with permissions to create:
  - **S3 bucket** (private)
  - **EC2 instance** (Amazon Linux 2023, t2.micro)
  - **IAM Role for EC2** (S3 read/write on your bucket)
- Node 18+ on the EC2 host

## 1) Create S3 bucket (private)

Example bucket name: `petpost-<your-id>` (keep **private**).You’ll use pre-signed URLs for images.

## 2) Create an IAM role for EC2 (attach to instance)

Create role `PetPostRole` with a policy granting S3 access to **your** bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::petpost-<your-id>"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::petpost-<your-id>/*"]
    }
  ]
}
```

## 3) Launch EC2

- Amazon Linux 2023, **t2.micro**
- Security Group:
  - Inbound **HTTP (80)** from `0.0.0.0/0`
  - Inbound **SSH (22)** from your IP only
- Attach the IAM role (`PetPostRole`) to the instance.

SSH in and install:
```bash
sudo dnf install -y nodejs git
```

## 4) Deploy the app

```bash
git clone https://github.com/<you>/petpost.git
cd petpost
npm install

# Set environment variables
export S3_BUCKET=petpost-<your-id>
export AWS_REGION=<your-region>

# Start the app on port 80 (use sudo to bind <1024)
sudo node app.js
```

Visit `http://<EC2-PUBLIC-IP>/` to upload and view pets.

### Optional: keep it running with PM2

```bash
sudo npm i -g pm2
sudo pm2 start app.js --name petpost
sudo pm2 save
sudo pm2 startup systemd
```

## Notes

- Max file upload size = **5MB** (see `multer` config).
- S3 bucket remains **private**; images are served via **pre-signed URLs**.
- If you run locally, set `PORT=3000` and open `http://localhost:3000`.

## License

MIT (use freely for coursework).
