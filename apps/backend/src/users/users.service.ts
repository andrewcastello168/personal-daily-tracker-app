import { KnexService } from './../database/knex.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdatePasswordDto } from './dto/update-user-password.dto';

type UserRow = {
  id: string;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  modify_dt: Date | null;
};

type UserPublic = {
  id: string;
  username: string;
  email: string;
  created_at: Date;
  modify_dt: Date | null;
};

type UserCreateResult = {
  id: string;
  username: string;
  email: string;
  created_at: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly knexService: KnexService) {}

  // Create User
  async create(createUserDto: CreateUserDto): Promise<UserCreateResult> {
    const existingUser = await this.knexService
      .connection<UserRow>('users')
      .where(function () {
        this.where('username', createUserDto.username).orWhere(
          'email',
          createUserDto.email,
        );
      })
      .first();

    if (existingUser) {
      throw new ConflictException('Username/Email has been used');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const [user] = await this.knexService
      .connection<UserRow, UserCreateResult[]>('users')
      .insert({
        username: createUserDto.username,
        email: createUserDto.email,
        password: hashedPassword,
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
  // Update Data User
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserPublic> {
    // 1. Cek user-nya ada dulu
    const existingUser = await this.knexService
      .connection<UserRow, UserPublic>('users')
      .where({ id })
      .select('id', 'username', 'email', 'created_at', 'modify_dt')
      .first();

    if (!existingUser) {
      throw new NotFoundException(`User ${id} tidak ditemukan`);
    }

    // 2. Cek duplicate username/email ke user lain
    if (updateUserDto.email || updateUserDto.username) {
      const duplicateUser = await this.knexService
        .connection<UserRow, UserPublic>('users')
        .whereNot('id', id)
        .andWhere(function () {
          if (updateUserDto.email) {
            this.orWhere('email', updateUserDto.email);
          }

          if (updateUserDto.username) {
            this.orWhere('username', updateUserDto.username);
          }
        })
        .select('id', 'username', 'email', 'created_at', 'modify_dt')
        .first();

      if (duplicateUser) {
        if (duplicateUser.email === updateUserDto.email) {
          throw new ConflictException('Email sudah digunakan user lain');
        }

        if (duplicateUser.username === updateUserDto.username) {
          throw new ConflictException('Username sudah digunakan user lain');
        }

        throw new ConflictException(
          'Email atau username sudah digunakan user lain',
        );
      }
    }

    // 3. Update data
    const [user] = await this.knexService
      .connection<UserRow, UserPublic[]>('users')
      .where({ id })
      .update({
        username: updateUserDto.username,
        email: updateUserDto.email,
        modify_dt: this.knexService.connection.fn.now(),
      })
      .returning(['id', 'username', 'email', 'created_at', 'modify_dt']);

    return user;
  }

  async updatePasswordUser(
    id: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<UserPublic> {
    const user = await this.knexService
      .connection<UserRow, UserRow>('users')
      .where({ id })
      .select('id', 'username', 'email', 'password', 'created_at', 'modify_dt')
      .first();

    if (!user) {
      throw new NotFoundException(`User ${id} tidak ditemukan`);
    }

    const isPasswordMatch = await bcrypt.compare(
      updatePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Password lama tidak sesuai');
    }

    const isSamePassword = await bcrypt.compare(
      updatePasswordDto.newPassword,
      user.password,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'Password baru tidak boleh sama dengan password lama',
      );
    }

    const hashedNewPassword = await bcrypt.hash(
      updatePasswordDto.newPassword,
      10,
    );

    const [updatedUser] = await this.knexService
      .connection<UserRow, UserPublic[]>('users')
      .where({ id })
      .update({
        password: hashedNewPassword,
        modify_dt: this.knexService.connection.fn.now(),
      })
      .returning(['id', 'username', 'email', 'created_at', 'modify_dt']);

    return updatedUser;
  }

  // Delete Data User
  async remove(id: string): Promise<{ message: string; data: UserPublic }> {
    const [user] = await this.knexService
      .connection<UserRow, UserPublic[]>('users')
      .where({ id })
      .del()
      .returning(['id', 'username', 'email', 'created_at', 'modify_dt']);

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return {
      message: 'User berhasil dihapus',
      data: user,
    };
  }
}
