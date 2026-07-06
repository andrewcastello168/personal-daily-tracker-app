import { KnexService } from './../database/knex.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type UserRow = {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  modify_dt: Date | null;
};

type UserPublic = {
  id: number;
  username: string;
  email: string;
  created_at: Date;
  modify_dt: Date | null;
};

type UserCreateResult = {
  id: number;
  username: string;
  email: string;
  created_at: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly knexService: KnexService) {}

  // Create User
  async create(createUserDto: CreateUserDto): Promise<UserCreateResult> {
    const [user] = await this.knexService
      .connection<UserRow, UserCreateResult[]>('users')
      .insert({
        username: createUserDto.username,
        email: createUserDto.email,
        password: createUserDto.password,
        created_at: this.knexService.connection.fn.now(),
      })
      .returning(['id', 'username', 'email', 'created_at']);

    return user;
  }

  // List All User
  async findAll(): Promise<UserPublic[]> {
    return this.knexService
      .connection<UserRow, UserPublic[]>('users')
      .select('id', 'username', 'email', 'created_at', 'modify_dt')
      .orderBy('created_at', 'desc');
  }

  // List One User by Username
  async findByUsername(username: string): Promise<UserPublic> {
    const user = await this.knexService
      .connection<UserRow, UserPublic>('users')
      .where({ username })
      .select('id', 'username', 'email', 'created_at', 'modify_dt')
      .first();

    if (!user) {
      throw new NotFoundException(`User ${username} tidak ditemukan`);
    }

    return user;
  }

  // Update Data User
  async update(
    username: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserPublic> {
    const [user] = await this.knexService
      .connection<UserRow, UserPublic[]>('users')
      .where({ username })
      .update({
        ...updateUserDto,
        modify_dt: this.knexService.connection.fn.now(),
      })
      .returning(['id', 'username', 'email', 'created_at', 'modify_dt']);

    if (!user) {
      throw new NotFoundException(`User ${username} tidak ditemukan`);
    }

    return user;
  }

  // Delete Data User
  async remove(
    username: string,
  ): Promise<{ message: string; data: UserPublic }> {
    const [user] = await this.knexService
      .connection<UserRow, UserPublic[]>('users')
      .where({ username })
      .del()
      .returning(['id', 'username', 'email', 'created_at', 'modify_dt']);

    if (!user) {
      throw new NotFoundException(`User ${username} tidak ditemukan`);
    }

    return {
      message: 'User berhasil dihapus',
      data: user,
    };
  }
}
