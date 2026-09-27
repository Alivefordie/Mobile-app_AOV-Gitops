import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecipeAccess } from '../../recipe-access/entities/recipe-access.entity';
import { Recipe } from '../../recipes/entities/recipe.entity';
import { Order } from './order.entity';

@Entity('order_items')
@Index(['orderId', 'recipeId'], { unique: true })
@Check('chk_order_items_unit_price', '"unit_price" >= 0')
export class OrderItem extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'recipe_id', type: 'uuid' })
  recipeId!: string;

  @ManyToOne(() => Recipe, (recipe) => recipe.orderItems, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;

  @Column({ name: 'recipe_title', type: 'varchar', length: 255 })
  recipeTitle!: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @OneToOne(() => RecipeAccess, (access) => access.orderItem)
  recipeAccess!: RecipeAccess | null;
}
