import mongoose, { Document, Schema } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
