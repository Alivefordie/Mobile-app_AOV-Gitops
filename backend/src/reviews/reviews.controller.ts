import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findAll(@Query('recipeId') recipeId?: string): Promise<Review[]> {
    return this.reviewsService.findAll(recipeId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Review> {
    return this.reviewsService.findOne(id);
  }

  @Post()
  create(@Body() data: Partial<Review>): Promise<Review> {
    return this.reviewsService.create(data);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: Partial<Review>,
  ): Promise<Review> {
    return this.reviewsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.reviewsService.remove(id);
  }
}
