import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TaskStatusEnum } from '@prisma/client';

import { CreateTaskDto, UpdateTaskDto } from '../src/modules/tasks/tasks.service';

describe('Task DTO validation', () => {
  it('rejects malformed numeric quantities instead of allowing a Prisma conversion error', async () => {
    const dto = plainToInstance(UpdateTaskDto, {
      actualQuantity: 'not-a-number',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'actualQuantity')).toBe(true);
  });

  it('rejects invalid task status values', async () => {
    const dto = plainToInstance(UpdateTaskDto, {
      status: 'NOT_A_STATUS',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('accepts a valid task update payload', async () => {
    const dto = plainToInstance(UpdateTaskDto, {
      title: 'Install inverter',
      plannedQuantity: '12',
      status: TaskStatusEnum.IN_PROGRESS,
      plannedStart: '2026-10-05T08:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.plannedQuantity).toBe(12);
  });

  it('requires project, title and code when creating a task', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: 'Install inverter',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['projectId', 'code']),
    );
  });
});
