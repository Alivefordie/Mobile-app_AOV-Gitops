import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, RecipeIngredient])],
  controllers: [IngredientsController],
  providers: [IngredientsService],
})
export class IngredientsModule {}
