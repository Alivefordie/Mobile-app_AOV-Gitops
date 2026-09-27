import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomBytes, scryptSync } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { Category } from '../../categories/entities/category.entity';
import { Favorite } from '../../favorites/entities/favorite.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { RecipeIngredient } from '../../ingredients/entities/recipe-ingredient.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { Order, OrderStatus } from '../../orders/entities/order.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import {
  RecipeAccess,
  RecipeAccessType,
} from '../../recipe-access/entities/recipe-access.entity';
import {
  RecipeContent,
  RecipeContentType,
} from '../../recipes/entities/recipe-content.entity';
import { RecipeSection } from '../../recipes/entities/recipe-section.entity';
import {
  Recipe,
  RecipeDifficulty,
  RecipeStatus,
} from '../../recipes/entities/recipe.entity';
import { Review, ReviewStatus } from '../../reviews/entities/review.entity';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';

const logger = new Logger('DatabaseSeed');

function hashDevelopmentPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);

    await dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const categoryRepository = manager.getRepository(Category);
      const ingredientRepository = manager.getRepository(Ingredient);
      const recipeRepository = manager.getRepository(Recipe);
      const recipeIngredientRepository =
        manager.getRepository(RecipeIngredient);
      const sectionRepository = manager.getRepository(RecipeSection);
      const contentRepository = manager.getRepository(RecipeContent);
      const orderRepository = manager.getRepository(Order);
      const orderItemRepository = manager.getRepository(OrderItem);
      const paymentRepository = manager.getRepository(Payment);
      const accessRepository = manager.getRepository(RecipeAccess);
      const reviewRepository = manager.getRepository(Review);
      const favoriteRepository = manager.getRepository(Favorite);

      let creator = await userRepository.findOne({
        where: { email: 'chef@recipy.local' },
      });
      if (!creator) {
        creator = await userRepository.save(
          userRepository.create({
            email: 'chef@recipy.local',
            passwordHash: hashDevelopmentPassword('Password123!'),
            displayName: 'เชฟมุก',
            avatarUrl: null,
            role: UserRole.CREATOR,
            status: UserStatus.ACTIVE,
          }),
        );
      }

      let customer = await userRepository.findOne({
        where: { email: 'customer@recipy.local' },
      });
      if (!customer) {
        customer = await userRepository.save(
          userRepository.create({
            email: 'customer@recipy.local',
            passwordHash: hashDevelopmentPassword('Password123!'),
            displayName: 'ผู้ใช้ทดสอบ',
            avatarUrl: null,
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
          }),
        );
      }

      const categorySeeds = [
        {
          name: 'อาหารไทย',
          slug: 'thai-food',
          description: 'สูตรอาหารไทย',
          sortOrder: 1,
        },
        {
          name: 'เมนูจานเดียว',
          slug: 'single-dish',
          description: 'เมนูทำง่ายสำหรับหนึ่งมื้อ',
          sortOrder: 2,
        },
      ];
      const categories: Category[] = [];
      for (const data of categorySeeds) {
        let category = await categoryRepository.findOne({
          where: { slug: data.slug },
        });
        if (!category) {
          category = await categoryRepository.save(
            categoryRepository.create(data),
          );
        }
        categories.push(category);
      }

      const ingredientSeeds = [
        { name: 'หมูสับ', imageUrl: null },
        { name: 'ใบกะเพรา', imageUrl: null },
        { name: 'กระเทียม', imageUrl: null },
        { name: 'พริกขี้หนู', imageUrl: null },
        { name: 'น้ำปลา', imageUrl: null },
      ];
      const ingredients = new Map<string, Ingredient>();
      for (const data of ingredientSeeds) {
        let ingredient = await ingredientRepository.findOne({
          where: { name: data.name },
        });
        if (!ingredient) {
          ingredient = await ingredientRepository.save(
            ingredientRepository.create(data),
          );
        }
        ingredients.set(ingredient.name, ingredient);
      }

      let recipe = await recipeRepository.findOne({
        where: { slug: 'pad-kaprao-pork-seed' },
        relations: { categories: true },
      });
      if (!recipe) {
        recipe = await recipeRepository.save(
          recipeRepository.create({
            creatorId: creator.id,
            title: 'กะเพราหมูสับสูตรร้านอาหาร',
            slug: 'pad-kaprao-pork-seed',
            shortDescription: 'สูตรกะเพราหมูสับสำหรับทดสอบระบบ Recipy',
            coverImageUrl: null,
            price: '199.00',
            preparationMinutes: 10,
            cookingMinutes: 15,
            servingCount: 2,
            difficulty: RecipeDifficulty.EASY,
            status: RecipeStatus.PUBLISHED,
            publishedAt: new Date(),
            categories,
          }),
        );
      }

      const recipeIngredientSeeds = [
        {
          name: 'หมูสับ',
          amount: '200.000',
          unit: 'กรัม',
          preparationNote: null,
          sortOrder: 1,
        },
        {
          name: 'ใบกะเพรา',
          amount: '1.000',
          unit: 'ถ้วย',
          preparationNote: 'เด็ดใบและล้างให้สะอาด',
          sortOrder: 2,
        },
        {
          name: 'กระเทียม',
          amount: '5.000',
          unit: 'กลีบ',
          preparationNote: 'สับหยาบ',
          sortOrder: 3,
        },
        {
          name: 'พริกขี้หนู',
          amount: '6.000',
          unit: 'เม็ด',
          preparationNote: 'ปรับตามระดับความเผ็ด',
          sortOrder: 4,
        },
        {
          name: 'น้ำปลา',
          amount: '1.000',
          unit: 'ช้อนโต๊ะ',
          preparationNote: null,
          sortOrder: 5,
        },
      ];
      for (const data of recipeIngredientSeeds) {
        const ingredient = ingredients.get(data.name);
        if (!ingredient) throw new Error(`Missing ingredient: ${data.name}`);

        const existing = await recipeIngredientRepository.findOne({
          where: {
            recipeId: recipe.id,
            ingredientId: ingredient.id,
            groupName: 'main',
          },
        });
        if (!existing) {
          await recipeIngredientRepository.save(
            recipeIngredientRepository.create({
              recipeId: recipe.id,
              ingredientId: ingredient.id,
              amount: data.amount,
              unit: data.unit,
              groupName: 'main',
              preparationNote: data.preparationNote,
              isOptional: false,
              sortOrder: data.sortOrder,
            }),
          );
        }
      }

      let preparationSection = await sectionRepository.findOne({
        where: { recipeId: recipe.id, title: 'การเตรียมวัตถุดิบ' },
      });
      if (!preparationSection) {
        preparationSection = await sectionRepository.save(
          sectionRepository.create({
            recipeId: recipe.id,
            title: 'การเตรียมวัตถุดิบ',
            description: 'เตรียมส่วนผสมก่อนเริ่มปรุง',
            sortOrder: 1,
            isPreview: true,
          }),
        );
      }

      let cookingSection = await sectionRepository.findOne({
        where: { recipeId: recipe.id, title: 'ขั้นตอนการปรุง' },
      });
      if (!cookingSection) {
        cookingSection = await sectionRepository.save(
          sectionRepository.create({
            recipeId: recipe.id,
            title: 'ขั้นตอนการปรุง',
            description: 'วิธีผัดกะเพราแบบละเอียด',
            sortOrder: 2,
            isPreview: false,
          }),
        );
      }

      const contentSeeds = [
        {
          sectionId: preparationSection.id,
          contentType: RecipeContentType.TEXT,
          title: 'เตรียมหมูและเครื่องผัด',
          textContent: 'สับกระเทียมและพริก จากนั้นเด็ดใบกะเพราเตรียมไว้',
          sortOrder: 1,
        },
        {
          sectionId: cookingSection.id,
          contentType: RecipeContentType.TEXT,
          title: 'ผัดเครื่องให้หอม',
          textContent: 'ตั้งกระทะ ใส่น้ำมัน แล้วผัดกระเทียมกับพริกจนหอม',
          sortOrder: 1,
        },
        {
          sectionId: cookingSection.id,
          contentType: RecipeContentType.TIP,
          title: 'เคล็ดลับ',
          textContent: 'ใส่ใบกะเพราเป็นขั้นตอนสุดท้ายและปิดไฟทันที',
          sortOrder: 2,
        },
      ];
      for (const data of contentSeeds) {
        const existing = await contentRepository.findOne({
          where: { sectionId: data.sectionId, title: data.title },
        });
        if (!existing) {
          await contentRepository.save(
            contentRepository.create({
              ...data,
              mediaUrl: null,
              durationSeconds: null,
            }),
          );
        }
      }

      let order = await orderRepository.findOne({
        where: { orderNumber: 'SEED-ORDER-0001' },
      });
      if (!order) {
        order = await orderRepository.save(
          orderRepository.create({
            orderNumber: 'SEED-ORDER-0001',
            userId: customer.id,
            subtotal: '199.00',
            discountAmount: '0.00',
            totalAmount: '199.00',
            currency: 'THB',
            status: OrderStatus.PAID,
            paidAt: new Date(),
            cancelledAt: null,
          }),
        );
      }

      let orderItem = await orderItemRepository.findOne({
        where: { orderId: order.id, recipeId: recipe.id },
      });
      if (!orderItem) {
        orderItem = await orderItemRepository.save(
          orderItemRepository.create({
            orderId: order.id,
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            creatorId: creator.id,
            unitPrice: '199.00',
          }),
        );
      }

      const payment = await paymentRepository.findOne({
        where: {
          provider: 'mock',
          providerTransactionId: 'SEED-TXN-0001',
        },
      });
      if (!payment) {
        await paymentRepository.save(
          paymentRepository.create({
            orderId: order.id,
            provider: 'mock',
            providerTransactionId: 'SEED-TXN-0001',
            paymentMethod: 'promptpay',
            amount: '199.00',
            currency: 'THB',
            status: PaymentStatus.SUCCESSFUL,
            paidAt: order.paidAt,
            failureReason: null,
            providerResponse: { seeded: true },
          }),
        );
      }

      const access = await accessRepository.findOne({
        where: { userId: customer.id, recipeId: recipe.id },
      });
      if (!access) {
        await accessRepository.save(
          accessRepository.create({
            userId: customer.id,
            recipeId: recipe.id,
            orderItemId: orderItem.id,
            accessType: RecipeAccessType.PURCHASE,
            grantedAt: order.paidAt ?? new Date(),
            expiresAt: null,
            revokedAt: null,
          }),
        );
      }

      const review = await reviewRepository.findOne({
        where: { userId: customer.id, recipeId: recipe.id },
      });
      if (!review) {
        await reviewRepository.save(
          reviewRepository.create({
            userId: customer.id,
            recipeId: recipe.id,
            rating: 5,
            comment: 'สูตรเข้าใจง่ายและทำตามได้จริง',
            status: ReviewStatus.PUBLISHED,
          }),
        );
      }

      const favorite = await favoriteRepository.findOne({
        where: { userId: customer.id, recipeId: recipe.id },
      });
      if (!favorite) {
        await favoriteRepository.save(
          favoriteRepository.create({
            userId: customer.id,
            recipeId: recipe.id,
          }),
        );
      }
    });

    logger.log('Seed completed successfully');
    logger.log('Creator: chef@recipy.local / Password123!');
    logger.log('Customer: customer@recipy.local / Password123!');
  } finally {
    await app.close();
  }
}

void seed().catch((error: unknown) => {
  logger.error(
    'Seed failed',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
