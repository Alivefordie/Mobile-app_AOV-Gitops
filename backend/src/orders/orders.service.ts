import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  findAll(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: { recipe: true }, payments: true },
    });
    if (!order) throw new NotFoundException(`Order with id ${id} not found`);
    return order;
  }

  create(data: Partial<Order>): Promise<Order> {
    return this.orderRepository.save(this.orderRepository.create(data));
  }

  async update(id: string, data: Partial<Order>): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, data, { id: order.id });
    return this.orderRepository.save(order);
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.orderRepository.remove(order);
  }
}
