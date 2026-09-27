import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  findAll(recipeId?: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: recipeId ? { recipeId } : {},
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: { user: true, recipe: true },
    });
    if (!review) throw new NotFoundException(`Review with id ${id} not found`);
    return review;
  }

  create(data: Partial<Review>): Promise<Review> {
    return this.reviewRepository.save(this.reviewRepository.create(data));
  }

  async update(id: string, data: Partial<Review>): Promise<Review> {
    const review = await this.findOne(id);
    Object.assign(review, data, { id: review.id });
    return this.reviewRepository.save(review);
  }

  async remove(id: string): Promise<void> {
    const review = await this.findOne(id);
    await this.reviewRepository.remove(review);
  }
}
