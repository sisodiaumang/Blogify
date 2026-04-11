import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });

        console.log("UPLOAD SUCCESS:", response.secure_url);

        fs.unlinkSync(localFilePath);
        return response;

    } catch (error) {
        console.log("CLOUDINARY ERROR:", error); // 🔥 ADD THIS

        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

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