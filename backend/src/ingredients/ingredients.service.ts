import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ingredient } from './entities/ingredient.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  findAll(): Promise<Ingredient[]> {
    return this.ingredientRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id },
    });
    if (!ingredient)
      throw new NotFoundException(`Ingredient with id ${id} not found`);
    return ingredient;
  }

  create(data: Partial<Ingredient>): Promise<Ingredient> {
    return this.ingredientRepository.save(
      this.ingredientRepository.create(data),
    );
  }

  async update(id: string, data: Partial<Ingredient>): Promise<Ingredient> {
    const ingredient = await this.findOne(id);
    Object.assign(ingredient, data, { id: ingredient.id });
    return this.ingredientRepository.save(ingredient);
  }

  async remove(id: string): Promise<void> {
    const ingredient = await this.findOne(id);
    await this.ingredientRepository.remove(ingredient);
  }
}
