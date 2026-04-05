import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { RecipientGroupsController } from './recipient-groups.controller';
import { RecipientGroupsService } from './recipient-groups.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [RecipientGroupsController],
  providers: [RecipientGroupsService],
  exports: [RecipientGroupsService],
})
export class RecipientGroupsModule {}
