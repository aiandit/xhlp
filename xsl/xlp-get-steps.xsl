<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:svg="http://www.w3.org/2000/svg"
  version="1.0">

  <xsl:output method="text" encoding="utf-8"/>

  <xsl:template match="text()"/>

  <xsl:template match="/"> [ <xsl:apply-templates mode="get-steps"/> ] </xsl:template>

  <xsl:template match="text()" mode="get-steps"/>

  <xsl:template match="steps/*" mode="get-steps">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="."/>
    <xsl:text>"</xsl:text>
    <xsl:if test="following-sibling::*[1]">, </xsl:if>
  </xsl:template>

</xsl:stylesheet>
