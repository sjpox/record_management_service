import { PartialType } from '@nestjs/mapped-types';
import { CreateDocOriginDto } from './create-doc-origin.dto';

export class UpdateDocOriginDto extends PartialType(CreateDocOriginDto) {}
