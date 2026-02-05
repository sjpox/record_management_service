import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { DocOriginsModule } from './modules/doc-origins/doc-origins.module';
import { ResponPersonsModule } from './modules/respon-persons/respon-persons.module';
import { ReceiversModule } from './modules/receivers/receivers.module';
import { StockRoomsModule } from './modules/stock-rooms/stock-rooms.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { InCommsModule } from './modules/in-comms/in-comms.module';
import { OutGoingsModule } from './modules/out-goings/out-goings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    HealthModule,
    DocOriginsModule,
    ResponPersonsModule,
    ReceiversModule,
    StockRoomsModule,
    VouchersModule,
    InCommsModule,
    OutGoingsModule,
    UsersModule,
  ],
})
export class AppModule {}
