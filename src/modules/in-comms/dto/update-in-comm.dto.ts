import { PartialType } from '@nestjs/mapped-types';
import { CreateInCommDto } from './create-in-comm.dto';

export class UpdateInCommDto extends PartialType(CreateInCommDto) {}
