import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Request limits, mirrored by CHAT_LIMITS in while-building-web's packages/types. */
export const CHAT_LIMITS = {
  maxMessages: 20,
  maxContentLength: 8_000,
  maxTotalLength: 32_000,
} as const;

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @Matches(/\S/, { message: 'content must not be empty' })
  @MaxLength(CHAT_LIMITS.maxContentLength)
  content!: string;
}

export class ChatRequestDto {
  /** The conversation so far, oldest first; it starts and ends with a user message. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CHAT_LIMITS.maxMessages)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  /** An enabled provider (see GET /models); default: AI_DEFAULT_PROVIDER. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  /** One of the provider's models (see GET /models); default: its first model. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;
}
