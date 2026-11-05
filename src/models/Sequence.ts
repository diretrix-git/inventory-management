import { Schema, model, models, type Model } from 'mongoose';

interface ISequence { _id: string; value: number }
const sequenceSchema = new Schema<ISequence>({
  _id: { type: String, required: true },
  value: { type: Number, required: true },
}, { versionKey: false });

export const Sequence = (models.Sequence as Model<ISequence>) || model<ISequence>('Sequence', sequenceSchema);
