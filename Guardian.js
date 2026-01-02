const mongoose = require('mongoose');

const guardianSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'اسم ولي الأمر مطلوب'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'رقم الهاتف مطلوب'],
        trim: true
    },
    alternatePhone: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    relationship: {
        type: String,
        enum: ['أب', 'أم', 'أخ', 'أخت', 'عم', 'عمة', 'خال', 'خالة', 'جد', 'جدة', 'أخرى'],
        default: 'أب'
    },
    // WhatsApp Communication
    whatsAppEnabled: {
        type: Boolean,
        default: true
    },
    whatsAppPhone: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for students
guardianSchema.virtual('students', {
    ref: 'Student',
    localField: '_id',
    foreignField: 'guardian'
});

// Method to get WhatsApp number (uses whatsAppPhone if set, otherwise phone)
guardianSchema.methods.getWhatsAppNumber = function () {
    return this.whatsAppPhone || this.phone;
};

module.exports = mongoose.model('Guardian', guardianSchema);
