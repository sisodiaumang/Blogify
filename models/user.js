const {Schema,model} =require("mongoose");
const { createHmac,randomBytes } = require('crypto');
const { createTokenForUser } = require("../services/authentication");



const userSchema = new Schema({
    fullName:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    salt:{
        type:String,
    }
    ,
    password:{
        type:String,
        required:true,
    },
    profileImageURL:{
        type:String,
    },
    profileImagePublicId:{
        type:String,
    },
    otp:{
        type:Number,
    },
    otpCreatedAt:{
        type:Date
    },
    role:{
        type:String,
        enum:['USER','ADMIN'],
        default:'USER'
    }
},{
    timestamps:true
});


userSchema.pre('save',function (){
    const user= this;

    if(!user.isModified("password")) return ;


    const salt = randomBytes(16).toString("hex");
    const hashedPassword = createHmac('sha256',salt)
    .update(user.password)
    .digest("hex");

    this.salt=salt;
    this.password=hashedPassword;

})


userSchema.static("matchPasswordAndGenerateToken",async function(email,password){
    const user = await this.findOne({email});
    if (!user) {
        throw new Error("User not found");
    }
    const salt = user.salt;
    const hashedPassword = user.password;
    const userProvidedHash = createHmac('sha256',salt)
    .update(password)
    .digest("hex");
    if(hashedPassword===userProvidedHash){
        const token = createTokenForUser(user);
        return token;
    }
    else{
        throw new Error('Incorrect Password');
    }
})



const User=model('user',userSchema);

module.exports = User;