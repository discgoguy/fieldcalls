import { uploadFile } from './supabaseClient';

// File upload — backed by Supabase Storage
export const UploadFile = ({ file }) => uploadFile(file, 'attachments');

// Stubs for integrations that were Base44-specific and are now handled server-side
export const SendEmail   = () => { throw new Error('SendEmail must be called via /api route'); };
export const SendSMS     = () => { throw new Error('SendSMS must be called via /api route'); };
export const InvokeLLM   = () => { throw new Error('InvokeLLM must be called via /api route'); };
export const GenerateImage = () => { throw new Error('GenerateImage must be called via /api route'); };
export const ExtractDataFromUploadedFile = () => { throw new Error('Use /api route for file extraction'); };

export const Core = {
  UploadFile,
  SendEmail,
  SendSMS,
  InvokeLLM,
  GenerateImage,
  ExtractDataFromUploadedFile,
};
