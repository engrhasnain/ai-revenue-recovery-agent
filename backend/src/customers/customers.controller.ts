import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PublicDemoGuard } from "../common/guards/public-demo.guard";
import { AI_THROTTLE } from "../common/throttle.constants";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers.query.dto";

@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query() query: ListCustomersQueryDto) {
    return this.customersService.list(query);
  }

  @Post()
  @HttpCode(201)
  create(@Body() payload: CreateCustomerDto) {
    return this.customersService.create(payload);
  }

  @Get(":customerId")
  get(@Param("customerId", ParseIntPipe) customerId: number) {
    return this.customersService.get(customerId);
  }

  @Patch(":customerId")
  update(@Param("customerId", ParseIntPipe) customerId: number, @Body() payload: UpdateCustomerDto) {
    return this.customersService.update(customerId, payload);
  }

  @Delete(":customerId")
  @HttpCode(204)
  @UseGuards(PublicDemoGuard)
  async remove(@Param("customerId", ParseIntPipe) customerId: number) {
    await this.customersService.remove(customerId);
  }

  @Post(":customerId/refresh-risk")
  @Throttle(AI_THROTTLE)
  refreshRisk(@Param("customerId", ParseIntPipe) customerId: number) {
    return this.customersService.refreshRisk(customerId);
  }
}
