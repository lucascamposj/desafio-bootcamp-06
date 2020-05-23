import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';
import { getRepository, In, getCustomRepository } from 'typeorm';
import Transaction from '../models/Transaction';
import uploadConfig from '../config/upload';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface FileTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

async function loadCSV(filePath: string): Promise<FileTransaction[]> {
  const readCSVStream = fs.createReadStream(filePath);

  const parseStream = csvParse({
    from_line: 2,
    ltrim: true,
    rtrim: true,
  });

  const parseCSV = readCSVStream.pipe(parseStream);

  const transactions: FileTransaction[] = [];

  parseCSV.on('data', line => {
    const [title, type, value, category] = line.map((cell: string) =>
      cell.trim(),
    );
    transactions.push({ title, type, value: Number(value), category });
  });

  await new Promise(resolve => {
    parseCSV.on('end', resolve);
  });

  return transactions;
}

class ImportTransactionsService {
  async execute(filename: string): Promise<Transaction[]> {
    const importFilePath = path.join(uploadConfig.directory, filename);
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const importedTransactions = await loadCSV(importFilePath);
    const importedCategories = importedTransactions.map(
      transaction => transaction.category,
    );

    // search for existent categories
    const existentCategories = await categoriesRepository.find({
      where: In(importedCategories),
    });
    const existentCategoriesTitles = existentCategories.map(c => c.title);

    // get non existent already
    const addCategoriesTitles = importedCategories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter(
        (category, index, categories) => categories.indexOf(category) === index,
      );

    const newCategories = categoriesRepository.create(
      addCategoriesTitles.map(title => ({ title })),
    );
    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const finalTransactions = transactionsRepository.create(
      importedTransactions.map(transaction => ({
        title: transaction.title,
        value: transaction.value,
        type: transaction.type,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(finalTransactions);

    return finalTransactions;
  }
}

export default ImportTransactionsService;
