# Pet Listing Project

A simple Express app that lets volunteers view all uploaded adoptable pets (name, breed, age, photo) as well as upload one of their own. Photos are stored in Amazon S3 and metadata is saved as a simple `pets.json` file in S3.

## Prerequisites
- **S3 bucket**
- **EC2 instance** (Amazon Linux 2023, t2.micro)
- **IAM Role for EC2** (S3 read/write on your bucket)
- Node 18+ on the EC2 host
