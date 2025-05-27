import { Module } from '@nestjs/common';
import { SuggestController } from './suggest.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [SuggestController],
})
export class SuggestModule {}
