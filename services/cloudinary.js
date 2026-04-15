import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (fileBuffer) => {
    try {
        if (!fileBuffer) return null;

        return await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { resource_type: "auto" },
                (error, result) => {
                    if (error) {
                        console.log("CLOUDINARY ERROR:", error);
                        return reject(error);
                    }
                    console.log("UPLOAD SUCCESS:", result.secure_url);
                    resolve(result);
                }
            );

            streamifier.createReadStream(fileBuffer).pipe(stream);
        });

    } catch (error) {
        console.log("UPLOAD FAILED:", error);
        return null;
    }
};
const deleteCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;

        const res = await cloudinary.uploader.destroy(publicId);
        
        return res;

    } catch (error) {
        
        return null;
    }
};

const getPublicId = (url) => {
    if (!url) return null;

    // Take only part after /upload/
    const afterUpload = url.split("/upload/")[1];

    // Remove version number if exists
    const noVersion = afterUpload.replace(/^v\d+\//, "");

    // Remove extension (.png, .jpg etc)
    return noVersion.split(".")[0];
};




export  {uploadOnCloudinary,deleteCloudinary,getPublicId}