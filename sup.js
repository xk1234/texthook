// upload.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file.
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;
const STORAGE_DIR = process.env.STORAGE_DIR; // e.g., "mivy0t_1" (or leave empty)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadFile() {
  // Define the local file to upload.
  const localFilePath = path.resolve('test.jpg');
  // Read the file data.
  const fileData = fs.readFileSync(localFilePath);
  // Use the file's base name.
  const fileName = path.basename(localFilePath);
  // Construct the file path in storage.
  const storageFilePath = STORAGE_DIR ? `${STORAGE_DIR}/${fileName}` : fileName;

  console.log(`Uploading ${localFilePath} to bucket "${BUCKET_NAME}" at path "${storageFilePath}"`);

  // Upload the file to Supabase Storage.
  const { data, error } = await supabase
    .storage
    .from(BUCKET_NAME)
    .upload(storageFilePath, fileData, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
  } else {
    console.log("Upload successful:", data);
  }
}

uploadFile();
