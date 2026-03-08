import { PartialType } from '@nestjs/swagger';
import { CreateOtherDocumentDto } from './create-other-document.dto';

export class UpdateOtherDocumentDto extends PartialType(CreateOtherDocumentDto) {}
