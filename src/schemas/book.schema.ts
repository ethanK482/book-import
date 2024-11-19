import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookDocument = Book & Document;

@Schema()
export class Book {
  @Prop({ type: String, required: true, unique: true })
  bookNum: string;
  @Prop({ type: String, required: true })
  name: string;
  @Prop({ type: String })
  description: string;
}

export const bookSchema = SchemaFactory.createForClass(Book);
