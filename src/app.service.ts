import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Book, BookDocument } from './schemas/book.schema';
import { Model } from 'mongoose';
import { read, utils } from 'xlsx';
@Injectable()
export class AppService {
  constructor(@InjectModel(Book.name) private bookModel: Model<BookDocument>) {}

  async getAll() {
    return await this.bookModel.find();
  }

  async processExcelFile(fileBuffer: Buffer) {
    const workbook = read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = utils.sheet_to_json(sheet) as Book[];

    const bookNums = data.map((row) => row.bookNum).filter(Boolean);
    const existingBooks = await this.bookModel
      .find({ bookNum: { $in: bookNums } })
      .lean();
    const existingBooksMap = new Map(
      existingBooks.map((book) => [book.bookNum, book]),
    );
    const bulkOps = [];
    const results = {
      inserted: [],
      updated: [],
      skipped: [],
      errors: [],
    };

    for (const row of data) {
      try {
        const { bookNum, name, description } = row;
        if (!bookNum || !name) {
          results.skipped.push({ row, reason: 'Missing required fields' });
          continue;
        }
        if (existingBooksMap.has(bookNum + '')) {
          const existingBook = existingBooksMap.get(bookNum + '');
          if (
            existingBook.name !== name ||
            existingBook.description !== description
          ) {
            bulkOps.push({
              updateOne: {
                filter: { bookNum },
                update: { $set: { name, description } },
              },
            });
            results.updated.push({ bookNum, name, description });
          } else {
            results.skipped.push({ row, reason: 'No changes detected' });
          }
        } else {
          bulkOps.push({
            insertOne: {
              document: { bookNum, name, description },
            },
          });
          results.inserted.push({ bookNum, name, description });
        }
      } catch (error) {
        results.errors.push({ row, error: error.message });
      }
    }

    if (bulkOps.length > 0) {
      await this.bookModel.bulkWrite(bulkOps);
    }

    return results;
  }
}
