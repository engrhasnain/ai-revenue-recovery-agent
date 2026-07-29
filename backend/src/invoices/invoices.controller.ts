import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { PublicDemoGuard } from "../common/guards/public-demo.guard";
import { AI_THROTTLE } from "../common/throttle.constants";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { ListInvoicesQueryDto } from "./dto/list-invoices.query.dto";

@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(@Query() query: ListInvoicesQueryDto) {
    return this.invoicesService.list(query);
  }

  @Post()
  @HttpCode(201)
  create(@Body() payload: CreateInvoiceDto) {
    return this.invoicesService.create(payload);
  }

  // Must be declared before ":invoiceId" so "bulk-extract" isn't swallowed by
  // the numeric id route.
  @Post("bulk-extract")
  @Throttle(AI_THROTTLE)
  @UseInterceptors(FilesInterceptor("files"))
  bulkExtract(@UploadedFiles() files: Express.Multer.File[]) {
    return this.invoicesService.bulkExtract(files ?? []);
  }

  @Get(":invoiceId")
  get(@Param("invoiceId", ParseIntPipe) invoiceId: number) {
    return this.invoicesService.get(invoiceId);
  }

  @Patch(":invoiceId")
  update(@Param("invoiceId", ParseIntPipe) invoiceId: number, @Body() payload: UpdateInvoiceDto) {
    return this.invoicesService.update(invoiceId, payload);
  }

  @Delete(":invoiceId")
  @HttpCode(204)
  @UseGuards(PublicDemoGuard)
  async remove(@Param("invoiceId", ParseIntPipe) invoiceId: number) {
    await this.invoicesService.remove(invoiceId);
  }

  @Get(":invoiceId/next-action")
  @Throttle(AI_THROTTLE)
  nextAction(@Param("invoiceId", ParseIntPipe) invoiceId: number) {
    return this.invoicesService.nextAction(invoiceId);
  }

  @Post(":invoiceId/mark-paid")
  markPaid(@Param("invoiceId", ParseIntPipe) invoiceId: number) {
    return this.invoicesService.markPaid(invoiceId);
  }
}
