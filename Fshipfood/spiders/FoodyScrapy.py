# -*- coding: utf-8 -*-
import scrapy
from scrapy.spiders import CrawlSpider, Rule
from scrapy.linkextractors import LinkExtractor

class FoodyscrapySpider(CrawlSpider):
    name = 'FoodyScrapy'
    allowed_domains = ['www.deliverynow.vn', 'www.foody.vn']
    start_urls = [
        # 'https://www.foody.vn/ha-noi'
        # 'https://www.deliverynow.vn/ha-noi',
        'https://www.deliverynow.vn/ha-noi/danh-sach-dia-diem-giao-tan-noi'
    ]


    def parse(self, response):
        for h3 in response.xpath('//h2').extract():
            yield {"title": h3}
