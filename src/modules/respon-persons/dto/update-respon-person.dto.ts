import { PartialType } from '@nestjs/mapped-types';
import { CreateResponPersonDto } from './create-respon-person.dto';

export class UpdateResponPersonDto extends PartialType(CreateResponPersonDto) {}
