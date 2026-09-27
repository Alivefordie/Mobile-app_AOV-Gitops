import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { Recipe } from '../../recipes/entities/recipe.entity';
import { User } from '../../users/entities/user.entity';

export enum RecipeAccessType {
  PURCHASE = 'purchase',
  FREE = 'free',
  PROMOTION = 'promotion',
  ADMIN_GRANT = 'admin_grant',
  GIFT = 'gift',
}

@Entity('recipe_access')
@Index(['userId', 'recipeId'], { unique: true })
export class RecipeAccess extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.recipeAccesses, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'recipe_id', type: 'uuid' })
  recipeId!: string;

  @ManyToOne(() => Recipe, (recipe) => recipe.accesses, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;

  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId!: string | null;

  @OneToOne(() => OrderItem, (item) => item.recipeAccess, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: OrderItem | null;

  @Column({
    name: 'access_type',
    type: 'enum',
    enum: RecipeAccessType,
    default: RecipeAccessType.PURCHASE,
  })
  accessType!: RecipeAccessType;

  @Column({
    name: 'granted_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  grantedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
