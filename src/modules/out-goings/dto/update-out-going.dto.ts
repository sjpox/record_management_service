import { PartialType } from '@nestjs/mapped-types';
import { CreateOutGoingDto } from './create-out-going.dto';

export class UpdateOutGoingDto extends PartialType(CreateOutGoingDto) {}
