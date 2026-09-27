import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipeAccessController } from './recipe-access.controller';
import { RecipeAccessService } from './recipe-access.service';
import { RecipeAccess } from './entities/recipe-access.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecipeAccess])],
  controllers: [RecipeAccessController],
  providers: [RecipeAccessService],
})
export class RecipeAccessModule {}
