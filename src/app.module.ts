import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import { AuthModule } from './modules/auth/auth.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { IndexDocumentModule } from './modules/index-document/index-document.module';
import { OtherDocumentModule } from './modules/other-document/other-document.module';
import { ShelfMapModule } from './modules/shelf-map/shelf-map.module';
import { LocationModule } from './modules/location/location.module';
import { ChatModule } from './modules/chat/chat.module';
import { MaintenanceMiddleware } from './modules/health/maintenance.middleware';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuditModule,
    HealthModule,
    AuthModule,
    VouchersModule,
    UsersModule,
    FilesModule,
    ReportsModule,
    IndexDocumentModule,
    OtherDocumentModule,
    LocationModule,
    ShelfMapModule,
    ChatModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MaintenanceMiddleware)
      .exclude('health/(.*)', 'health', 'auth/login', 'auth/refresh')
      .forRoutes('*');
  }
}
