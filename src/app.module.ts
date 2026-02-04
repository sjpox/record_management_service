import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { DocOriginsModule } from './modules/doc-origins/doc-origins.module';
import { ResponPersonsModule } from './modules/respon-persons/respon-persons.module';
import { DocTypesModule } from './modules/doc-types/doc-types.module';
import { ReceiversModule } from './modules/receivers/receivers.module';
import { StockRoomsModule } from './modules/stock-rooms/stock-rooms.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { InCommsModule } from './modules/in-comms/in-comms.module';
import { OutGoingsModule } from './modules/out-goings/out-goings.module';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    DocOriginsModule,
    ResponPersonsModule,
    DocTypesModule,
    ReceiversModule,
    StockRoomsModule,
    VouchersModule,
    InCommsModule,
    OutGoingsModule,
  ],
})
export class AppModule {}
