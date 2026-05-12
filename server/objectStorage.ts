import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // Gets the private object directory for car photos
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Object storage not properly configured."
      );
    }
    return dir;
  }

  // Gets the upload URL for a car photo
  async getCarPhotoUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const photoId = randomUUID();
    const fullPath = `${privateObjectDir}/car-photos/${photoId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });
  }

  // Gets the car photo file from the object path
  async getCarPhotoFile(photoPath: string): Promise<File> {
    if (!photoPath.startsWith("/car-photos/")) {
      throw new ObjectNotFoundError();
    }

    const privateObjectDir = this.getPrivateObjectDir();
    const fullObjectPath = `${privateObjectDir}${photoPath}`;
    const { bucketName, objectName } = parseObjectPath(fullObjectPath);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    return objectFile;
  }

  // Normalize car photo URL to internal path
  normalizeCarPhotoPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    
    let privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir.endsWith("/")) {
      privateObjectDir = `${privateObjectDir}/`;
    }

    if (!rawObjectPath.startsWith(privateObjectDir)) {
      return rawObjectPath;
    }

    const photoPath = rawObjectPath.slice(privateObjectDir.length);
    return `/${photoPath}`;
  }

  // Download car photo to response
  async downloadCarPhoto(file: File, res: Response) {
    try {
      const [metadata] = await file.getMetadata();
      
      res.set({
        "Content-Type": metadata.contentType || "image/jpeg",
        "Content-Length": metadata.size,
        "Cache-Control": "private, max-age=3600",
      });

      const stream = file.createReadStream();
      
      stream.on("error", (err) => {
        console.error("Car photo stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming car photo" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading car photo:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading car photo" });
      }
    }
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return { bucketName, objectName };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}