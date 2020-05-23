import { getRepository, getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute(request: Request): Promise<Transaction> {
    const { title, value, type, category } = request;
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const balance = await transactionsRepository.getBalance();

    if (type === 'outcome' && value > balance.total) {
      throw new AppError('Not enough balance to execute transaction.');
    }

    const categoryRepository = getRepository(Category);

    // check if already exists category
    let categoryObject = await categoryRepository.findOne({
      where: { title: category },
    });

    if (categoryObject === undefined) {
      categoryObject = categoryRepository.create({ title: category });
      categoryObject = await categoryRepository.save(categoryObject);
    }

    let transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id: categoryObject.id,
    });

    transaction = await transactionsRepository.save(transaction);
    transaction.category = categoryObject;
    delete transaction.category_id;

    return transaction;
  }
}

export default CreateTransactionService;
