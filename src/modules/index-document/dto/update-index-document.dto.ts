import { PartialType } from '@nestjs/swagger';
import { CreateIndexDocumentDto } from './create-index-document.dto';

export class UpdateIndexDocumentDto extends PartialType(CreateIndexDocumentDto) {}
