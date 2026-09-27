import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Recipe } from '../../recipes/entities/recipe.entity';
import { Ingredient } from './ingredient.entity';

@Entity('recipe_ingredients')
@Index(['recipeId', 'ingredientId', 'groupName'], { unique: true })
@Index(['recipeId', 'sortOrder'])
@Check('chk_recipe_ingredients_amount', '"amount" IS NULL OR "amount" >= 0')
@Check('chk_recipe_ingredients_sort_order', '"sort_order" >= 0')
export class RecipeIngredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recipe_id', type: 'uuid' })
  recipeId!: string;

  @ManyToOne(() => Recipe, (recipe) => recipe.recipeIngredients, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;

  @Column({ name: 'ingredient_id', type: 'uuid' })
  ingredientId!: string;

  @ManyToOne(() => Ingredient, (ingredient) => ingredient.recipeIngredients, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient!: Ingredient;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  amount!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit!: string | null;

  @Column({ name: 'group_name', type: 'varchar', length: 100, default: 'main' })
  groupName!: string;

  @Column({
    name: 'preparation_note',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  preparationNote!: string | null;

  @Column({ name: 'is_optional', type: 'boolean', default: false })
  isOptional!: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;
}
